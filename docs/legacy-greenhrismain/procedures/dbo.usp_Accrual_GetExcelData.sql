
-- =============================================
-- Author:		Nianz
-- Create date: 22.Oct.2022 15:03
-- Description:	Get records for Excel Acrual
-- =============================================
CREATE PROCEDURE [dbo].[usp_Accrual_GetExcelData]
	@idClient INT,
	@departmentCode INT, 
	@dateFrom  Date
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

	SELECT 
		e.employee_id, [fullname] = UPPER(TRIM(e.lname + ', ' + e.fname + ' ' + ISNULL(e.mname,''))), e.status, cbp.jobposition, d.Department_desc, e.departmentsub 
	FROM 
		Employee As e 
		INNER JOIN client_branch_position AS cbp ON e.Position1 = cbp.idbranchposition 
		INNER JOIN Department AS d ON e.department_code = d.iddepartment 
	WHERE 
		cbp.idclient = @idClient
		AND e.department_code = @departmentCode
		AND e.forpayroll = 'Y' 
		AND e.employee_id NOT IN (SELECT TOP 1 Employee_id FROM payroll_summary AS ps WHERE ps.Employee_id = e.employee_id AND  idclientp = e.idclient and Date_Start = @dateFrom) 
	ORDER BY  jobposition, fullname
END
