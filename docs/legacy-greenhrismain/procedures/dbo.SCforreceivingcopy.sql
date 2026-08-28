-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[SCforreceivingcopy]
	-- Add the parameters for the stored procedure here
		--@parayear nvarchar(5),
		@idclient int,
		@iddepartment int,
		@paythrough nvarchar(12),
		@payoutdate date,
		@fromdate date,
		@enddate date


AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
if (@paythrough <> '') 
	begin

		SELECT        client_branch_position.jobposition, client.companyname, Department.Department_desc, Employee.datehired, client.signprepared, client.signapproved, client.signnoted, Employee.bankaccountno, Employee.paythrough, 
                         servicecharge.fromdate, servicecharge.receiveamount, servicecharge.enddate, servicecharge.payoutdate, Employee.lname, Employee.fname, Employee.mname, servicecharge.employee_id, Employee.gcash
		FROM            servicecharge INNER JOIN
                         client ON servicecharge.idclient = client.idclient INNER JOIN
                         client_branch_position ON servicecharge.idposition = client_branch_position.idbranchposition INNER JOIN
                         Employee ON servicecharge.employee_id = Employee.Employee_id INNER JOIN
                         Department ON servicecharge.iddepartment = Department.iddepartment
		WHERE        (servicecharge.idclient = @idclient) AND (servicecharge.iddepartment = @iddepartment) AND (RTRIM(Employee.paythrough)=RTRIM(@paythrough)) and (payoutdate =@payoutdate) and (fromdate >=@fromdate and enddate <= @enddate)
		ORDER BY Employee.lname
	end 

if (@paythrough = '') 
	begin

		SELECT        client_branch_position.jobposition, client.companyname, Department.Department_desc, Employee.datehired, client.signprepared, client.signapproved, client.signnoted, Employee.bankaccountno, Employee.paythrough, 
                         servicecharge.fromdate, servicecharge.receiveamount, servicecharge.enddate, servicecharge.payoutdate, Employee.lname, Employee.fname, Employee.mname, servicecharge.employee_id, Employee.gcash
		FROM            servicecharge INNER JOIN
                         client ON servicecharge.idclient = client.idclient INNER JOIN
                         client_branch_position ON servicecharge.idposition = client_branch_position.idbranchposition INNER JOIN
                         Employee ON servicecharge.employee_id = Employee.Employee_id INNER JOIN
                         Department ON servicecharge.iddepartment = Department.iddepartment
		WHERE        (servicecharge.idclient = @idclient) AND (servicecharge.iddepartment = @iddepartment) and (payoutdate =@payoutdate ) and (fromdate >=@fromdate and enddate <= @enddate)
		ORDER BY Employee.lname
	end 
	
END
