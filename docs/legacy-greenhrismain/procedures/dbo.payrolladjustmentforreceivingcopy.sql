-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
create PROCEDURE  [dbo].[payrolladjustmentforreceivingcopy]
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
--if (@paythrough <> '') 
--	begin

		SELECT        client_branch_position.jobposition, client.companyname, Department.Department_desc, Employee.datehired, client.signprepared, client.signapproved, client.signnoted, Employee.bankaccountno, Employee.paythrough, 
                         payrolladjustmenttbl.fromdate, payrolladjustmenttbl.receiveamount, payrolladjustmenttbl.enddate, payrolladjustmenttbl.payoutdate, Employee.lname, Employee.fname, Employee.mname, payrolladjustmenttbl.employee_id
		FROM            payrolladjustmenttbl INNER JOIN
                         client ON payrolladjustmenttbl.idclient = client.idclient INNER JOIN
                         client_branch_position ON payrolladjustmenttbl.idposition = client_branch_position.idbranchposition INNER JOIN
                         Employee ON payrolladjustmenttbl.employee_id = Employee.Employee_id INNER JOIN
                         Department ON payrolladjustmenttbl.iddepartment = Department.iddepartment
		WHERE			 (payrolladjustmenttbl.idclient = @idclient) 
							AND (payrolladjustmenttbl.iddepartment = @iddepartment) 
							and (payoutdate =@payoutdate) 
							and (fromdate >=@fromdate 
							and enddate <= @enddate)
							AND (Employee.paythrough= CASE WHEN @paythrough = '' THEN employee.paythrough ELSE @paythrough END) 
		ORDER BY Employee.lname
--	end 


/*

if (@paythrough = '') 
begin

		SELECT        client_branch_position.jobposition, client.companyname, Department.Department_desc, Employee.datehired, client.signprepared, client.signapproved, client.signnoted, Employee.bankaccountno, Employee.paythrough, 
                        payrolladjustmenttbl.fromdate, payrolladjustmenttbl.receiveamount, payrolladjustmenttbl.enddate, payrolladjustmenttbl.payoutdate, Employee.lname, Employee.fname, Employee.mname, payrolladjustmenttbl.employee_id
		FROM            payrolladjustmenttbl INNER JOIN
                         client ON payrolladjustmenttbl.idclient = client.idclient INNER JOIN
                         client_branch_position ON payrolladjustmenttbl.idposition = client_branch_position.idbranchposition INNER JOIN
                         Employee ON payrolladjustmenttbl.employee_id = Employee.Employee_id INNER JOIN
                         Department ON payrolladjustmenttbl.iddepartment = Department.iddepartment
		WHERE        (payrolladjustmenttbl.idclient = @idclient) AND (payrolladjustmenttbl.iddepartment = @iddepartment) and (payoutdate =@payoutdate ) and (fromdate >=@fromdate and enddate <= @enddate)
		ORDER BY Employee.lname
	end 
*/
		
	
END
