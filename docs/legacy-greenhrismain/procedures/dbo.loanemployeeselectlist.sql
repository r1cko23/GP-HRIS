-- =============================================
-- Author:		<Pat Relos>
-- Create date: <7-6-2023>
-- Description:	<Loan Employee List Select- it shows active list of employee who are candidate to avail laons exclude employee already avail loan>
-- =============================================
CREATE PROCEDURE  [dbo].[loanemployeeselectlist]
	-- Add the parameters for the stored procedure here
	@keytext varchar(50), 
	@idclient int,
	@iddepart int
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

SELECT  DISTINCT top 300
                         Employee.Employee_id, loan.employee_id AS empidloan, Employee.idclient, Employee.department_code, Employee.lname, Employee.fname, Employee.mname, Employee.employee_status, Employee.status, 
                         client_branch_position.jobposition, client.companyname, Department.Department_desc
FROM            Employee INNER JOIN
                         client_branch_position ON Employee.Position1 = client_branch_position.idbranchposition INNER JOIN
                         client ON Employee.idclient = client.idclient INNER JOIN
                         Department ON Employee.department_code = Department.iddepartment LEFT OUTER JOIN
                         loan ON Employee.Employee_id = loan.employee_id
WHERE        
--(Employee.idclient = @idclient) 
--and (employee.department_code = @iddepart) 
(Employee.fname LIKE '%' + @keytext + '%') 	or (Employee.lname LIKE '%' + @keytext + '%') 
AND (Employee.status = N'Active') --OR (Employee.idclient = @idclient) and (employee.department_code = @iddepart) 

AND (Employee.status = N'Active')

order by lname,fname

END
