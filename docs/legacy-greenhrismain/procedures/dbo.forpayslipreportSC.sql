-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<use in datagrid view list employee with loan>
-- =============================================
CREATE PROCEDURE  [dbo].[forpayslipreportSC]
	-- Add the parameters for the stored procedure here
		@idclient int,
		@iddepartment int,
		@payoutdate date,
		@fromdate date,
		@enddate date, 
		@paythrough nvarchar(12)
	
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT        client.companyname, Department.Department_desc, servicecharge.receiveamount, servicecharge.enddate, servicecharge.fromdate, servicecharge.payoutdate, servicecharge.employee_id, Employee.lname, Employee.fname, 
                         Employee.mname, client_branch_position.jobposition, servicecharge.idclient, servicecharge.iddepartment
FROM            servicecharge INNER JOIN
                         client ON servicecharge.idclient = client.idclient INNER JOIN
                         Department ON servicecharge.iddepartment = Department.iddepartment INNER JOIN
                         Employee ON servicecharge.employee_id = Employee.Employee_id INNER JOIN
                         client_branch_position ON servicecharge.idposition = client_branch_position.idbranchposition
WHERE        (servicecharge.idclient = @idclient) 
AND (servicecharge.iddepartment = @iddepartment) 
AND (servicecharge.payoutdate = @payoutdate) 
and (fromdate >=@fromdate and enddate <= @enddate)
AND (Employee.paythrough= CASE WHEN @paythrough = '' THEN employee.paythrough ELSE @paythrough END) 
END
